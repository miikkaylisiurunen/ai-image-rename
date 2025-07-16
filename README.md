# AI Image Rename

> Command-line tool to automatically rename images using AI

![Demo](https://github.com/miikkaylisiurunen/ai-image-rename/blob/main/assets/demo.gif)

## Features

- Analyzes images using AI to generate descriptive filenames
- Supports multiple naming formats
- Processes multiple images concurrently
- Handles PNG, JPG, JPEG, and WebP formats

## Prerequisites

- Node.js v18 or higher
- OpenRouter API key

## Installation

You can install this package globally using npm:

```bash
npm install -g @miikkaylisiurunen/ai-image-rename
```

This allows you to use the command directly.

Alternatively, you can run the tool without a global installation using `npx`:

```bash
npx @miikkaylisiurunen/ai-image-rename image1.jpg image2.png
```

## Setup

### Environment Variables

You need to set your OpenRouter API key. You can do this in two ways:

**Option 1: Export the variable (persistent for the terminal session)**

```bash
# First, export the API key
export OPENROUTER_API_KEY="your-key"

# Then run the tool:
ai-image-rename image1.jpg image2.png

# or with npx
npx @miikkaylisiurunen/ai-image-rename image1.jpg image2.png
```

**Option 2: Inline with the command (one-time use)**

```bash
# Set the API key only for this single command:
OPENROUTER_API_KEY="your-key" ai-image-rename image1.jpg image2.png

# or with npx
OPENROUTER_API_KEY="your-key" npx @miikkaylisiurunen/ai-image-rename image1.jpg image2.png
```

### Optional Configuration

Use a specific AI model (defaults to `google/gemini-2.0-flash-001`):

```bash
export OPENROUTER_MODEL="your-preferred-model"
```

## Usage

```bash
# Process specific images:
ai-image-rename image1.jpg image2.png image3.webp

# Process all JPG files in the current directory:
ai-image-rename *.jpg

# With inline environment variables:
OPENROUTER_API_KEY="your-key" OPENROUTER_MODEL="your-preferred-model" ai-image-rename *.jpg
```

The tool will:

1. Filter valid images
2. Ask you to select a naming format
3. Ask for the number of concurrent operations
4. Process and rename the images based on their content

## Naming Formats

- Snake: `my_file_name.jpg`
- Kebab: `my-file-name.jpg`
- Pascal: `MyFileName.jpg`
- Camel: `myFileName.jpg`
- Capital: `My File Name.jpg`
- Lowercase: `my file name.jpg`
- Sentence: `My file name.jpg`
