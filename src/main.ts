import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { Mutex } from 'async-mutex';
import * as changeCase from 'change-case';

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

const renameMutex = new Mutex();

interface ApiSuccessResponse {
  choices?: {
    message?: {
      content: string | null;
    };
  }[];
}

type Format = 'snake' | 'kebab' | 'pascal' | 'camel' | 'capital' | 'lowercase' | 'sentence';
type ProcessResult =
  | { status: 'success'; newPath: string }
  | { status: 'skipped' }
  | { status: 'error' };

type ProcessStatus = ProcessResult['status'];

async function imageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = await fs.readFile(imagePath);
  const imageBase64 = imageBuffer.toString('base64');
  const ext = path.extname(imagePath);

  let mimeExtension = ext.toLowerCase().slice(1);
  if (mimeExtension === 'jpg') mimeExtension = 'jpeg';
  const mimeType = `image/${mimeExtension}`;

  return `data:${mimeType};base64,${imageBase64}`;
}

function convertCase(name: string, format: Format): string {
  let result: string = '';
  switch (format) {
    case 'snake':
      result = changeCase.snakeCase(name);
      break;
    case 'kebab':
      result = changeCase.kebabCase(name);
      break;
    case 'pascal':
      result = changeCase.pascalCase(name);
      break;
    case 'camel':
      result = changeCase.camelCase(name);
      break;
    case 'capital':
      result = changeCase.capitalCase(name);
      break;
    case 'lowercase':
      result = changeCase.noCase(name);
      break;
    case 'sentence':
      result = changeCase.sentenceCase(name);
      break;
    default:
      result = changeCase.snakeCase(name);
      break;
  }

  return result.trim().substring(0, 200);
}

async function getNewFilename(imageBase64: string): Promise<string> {
  const prompt =
    'Create a descriptive filename for this image using 2-5 English words separated by spaces. Use only lowercase letters, numbers and spaces, no punctuation or special characters. Return only the filename with no additional text or explanations.';

  const payload = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ],
    max_tokens: 50,
    temperature: 1,
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error();
  }

  const data = (await response.json()) as ApiSuccessResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error();
  }
  return content;
}

async function processImage(imagePath: string, format: Format): Promise<ProcessResult> {
  try {
    const imageBase64 = await imageToBase64(imagePath);
    const aiName = await getNewFilename(imageBase64);

    if (!aiName) {
      return { status: 'skipped' };
    }

    const sanitizedName = convertCase(aiName, format);

    if (!sanitizedName) {
      return { status: 'skipped' };
    }

    const fileExt = path.extname(imagePath);
    const newFilePath = path.join(path.dirname(imagePath), `${sanitizedName}${fileExt}`);

    if (imagePath === newFilePath) {
      return { status: 'skipped' };
    }

    return await renameMutex.runExclusive(async () => {
      if (await doesFileExist(newFilePath)) {
        return { status: 'skipped' };
      }

      await fs.rename(imagePath, newFilePath);
      return { status: 'success', newPath: newFilePath };
    });
  } catch {
    return { status: 'error' };
  }
}

async function doesFileExist(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function isFileReadable(filePath: string): Promise<boolean> {
  if (!(await doesFileExist(filePath))) {
    return false;
  }

  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function filterValidImagePaths(imagePaths: string[]): Promise<Set<string>> {
  const validImagePaths = new Set<string>();
  const spinner = clack.spinner();
  spinner.start('Filtering input files...');

  for (const pth of imagePaths) {
    const existsAndReadable = await isFileReadable(pth);
    const ext = path.extname(pth).toLowerCase();
    if (existsAndReadable && ALLOWED_EXTENSIONS.includes(ext)) {
      validImagePaths.add(pth);
    }
  }

  spinner.stop(`Found ${validImagePaths.size} valid image(s).`);
  return validImagePaths;
}

async function main() {
  clack.updateSettings({ messages: { cancel: 'Operation cancelled.' } });
  clack.intro('AI Image Rename');

  if (!OPENROUTER_API_KEY) {
    clack.log.error('OPENROUTER_API_KEY environment variable is not set.');
    clack.outro('Setup incomplete. Exiting.');
    process.exit(1);
  }

  const imagePaths = process.argv.slice(2);
  if (imagePaths.length === 0) {
    clack.log.warn('No image files provided.');
    clack.log.info('Usage: ai-image-rename <image_file1.jpg> ...');
    clack.outro('Exiting.');
    process.exit(0);
  }

  const validImagePaths = await filterValidImagePaths(imagePaths);

  if (validImagePaths.size === 0) {
    clack.log.warn('No valid image files to process.');
    clack.outro('Exiting.');
    process.exit(0);
  }

  const userSelections = await clack.group(
    {
      filenameFormat: () =>
        clack.select<Format>({
          message: 'Select the desired filename format:',
          options: [
            { value: 'snake', label: 'Snake Case', hint: 'my_file_name.jpg' },
            { value: 'kebab', label: 'Kebab Case', hint: 'my-file-name.jpg' },
            { value: 'pascal', label: 'Pascal Case', hint: 'MyFileName.jpg' },
            { value: 'camel', label: 'Camel Case', hint: 'myFileName.jpg' },
            { value: 'capital', label: 'Capital Case', hint: 'My File Name.jpg' },
            { value: 'lowercase', label: 'Lowercase Spaces', hint: 'my file name.jpg' },
            { value: 'sentence', label: 'Sentence Case', hint: 'My file name.jpg' },
          ],
          initialValue: 'snake',
        }),
      maxConcurrency: () =>
        clack.text({
          message: 'Max concurrent operations:',
          placeholder: '3',
          validate(value) {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1) return 'Please enter a positive number.';
          },
        }),
    },
    {
      onCancel: () => {
        clack.cancel('Operation cancelled.');
        process.exit(0);
      },
    }
  );

  const filenameFormat = userSelections.filenameFormat;
  const concurrencyLimit = parseInt(userSelections.maxConcurrency, 10);
  const pLimitInstance = pLimit(concurrencyLimit);

  let done = 0;
  const results: Record<ProcessStatus, number> = {
    success: 0,
    skipped: 0,
    error: 0,
  };

  const log = clack.taskLog({
    title: 'Processing images...',
    limit: 5,
  });

  const processingTasks = Array.from(validImagePaths).map((imagePath: string) =>
    pLimitInstance(async () => {
      const fileName = path.basename(imagePath);
      const result = await processImage(imagePath, filenameFormat);
      results[result.status]++;
      done++;

      let statusText = '';
      if (result.status === 'success') {
        statusText = pc.green('SUCCESS');
      } else if (result.status === 'skipped') {
        statusText = pc.yellow('SKIPPED');
      } else {
        statusText = pc.red('ERROR');
      }

      const newFileName = result.status === 'success' ? ` -> ${path.basename(result.newPath)}` : '';
      log.message(`[${statusText}] ${fileName}${newFileName} (${done}/${validImagePaths.size})`);
    })
  );

  await Promise.all(processingTasks);

  log.success('Processing complete.');

  clack.log.info(
    `Summary: ${pc.green(results['success'])} renamed, ${pc.yellow(
      results['skipped']
    )} skipped, ${pc.red(results['error'])} errors.`
  );
  clack.outro('✨ All done!');
}

main().catch((error: unknown) => {
  clack.log.error('An unexpected application error occurred:');
  if (error instanceof Error) {
    clack.log.error(error.message);
  } else {
    clack.log.error(String(error));
  }
  clack.outro('Application terminated due to an error.');
  process.exit(1);
});
