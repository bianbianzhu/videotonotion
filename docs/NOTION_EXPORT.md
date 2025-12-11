# Notion Export Guide

This guide explains how to use the generated notes from Video to Notion in your Notion workspace.

## Overview

Video to Notion generates structured notes that are designed to be compatible with Notion's formatting. Currently, the application supports two export methods:

1. **Copy to Clipboard** - Copy formatted content to paste into Notion
2. **Download HTML** - Download as an HTML file

## Export Methods

### Method 1: Copy to Clipboard

The fastest way to get your notes into Notion.

#### Steps

1. Process your video in Video to Notion
2. Once notes are generated, click the **"Copy to Notion"** button
3. Open Notion and navigate to your target page
4. Press `Ctrl+V` (Windows/Linux) or `Cmd+V` (macOS) to paste

#### What Gets Copied

- Section titles with timestamps
- Summary text (markdown formatted)
- Images (as embedded data URLs)

#### Tips

- Paste into an empty Notion page for best results
- Use Notion's `/toc` command to add a table of contents
- Timestamps appear as badges next to section titles

### Method 2: Download HTML

Download notes as a standalone HTML file for archival or sharing.

#### Steps

1. Process your video
2. Click the **"Download HTML"** button
3. Save the file to your computer
4. Open in any web browser to view

#### Use Cases

- Offline viewing
- Email attachments
- Backup/archival
- Sharing with non-Notion users

## Importing to Notion

### Manual Import (Recommended)

Since Notion doesn't have a direct API integration yet, manual copy-paste provides the best results:

```
Video to Notion → Copy to Clipboard → Paste in Notion
```

### From HTML File

If you have the HTML file:

1. Open the HTML file in a browser
2. Select all content (`Ctrl+A` / `Cmd+A`)
3. Copy (`Ctrl+C` / `Cmd+C`)
4. Paste into Notion (`Ctrl+V` / `Cmd+V`)

## Formatting in Notion

### After Pasting

Your pasted content will include:

| Element | Notion Format |
|---------|---------------|
| Section titles | Heading 2 |
| Timestamps | Inline badge |
| Summary text | Paragraph |
| Images | Embedded image |

### Recommended Enhancements

After pasting, consider adding:

1. **Table of Contents**
   - Type `/toc` and press Enter
   - Automatically links to all headings

2. **Callouts for Key Points**
   - Select important text
   - Type `/callout` to highlight

3. **Toggle Lists for Long Sections**
   - Collapse lengthy content
   - Type `/toggle` to create

4. **Video Embed**
   - Add the original video URL
   - Type `/video` and paste the YouTube link

### Example Notion Page Structure

```
📺 [Video Title]
├── 🎬 Original Video (embedded YouTube)
├── 📋 Table of Contents
│
├── 📝 Introduction [0:30]
│   ├── Summary text...
│   └── 🖼️ Frame image
│
├── 📝 Core Concepts [3:00]
│   ├── Summary text...
│   └── 🖼️ Frame image
│
└── 📝 Conclusion [15:00]
    ├── Summary text...
    └── 🖼️ Frame image
```

## Working with Images

### Current Behavior

- Images are embedded as **data URLs** (base64-encoded)
- They display correctly when pasted
- No external hosting required

### Limitations

- Large images may slow down pasting
- Data URLs increase page size
- Images cannot be edited after pasting

### Notion Image Optimization

After pasting, you can:

1. Click on any image to resize
2. Add captions by clicking below the image
3. Drag images to rearrange
4. Delete unwanted frames

## Current Limitations

### What Works Well

- Text content (titles, summaries)
- Basic markdown formatting
- Embedded images
- Timestamp information

### Known Limitations

| Limitation | Workaround |
|------------|------------|
| No direct Notion API integration | Use copy/paste |
| Images as data URLs | Will work but increases size |
| Markdown tables may not convert | Manually create Notion tables |
| Code blocks formatting | May need manual adjustment |
| Timestamps not clickable | Add video embed for reference |

### Planned Improvements

Future versions may include:

- Direct Notion API integration
- Automatic page creation
- Database entries for video notes
- Clickable timestamp links
- Image upload to Notion (external URLs)

## Tips for Best Results

### Before Processing

1. **Choose Good Quality Videos**
   - Clear audio improves AI analysis
   - Visible slides/content helps frame extraction

2. **Consider Video Length**
   - Longer videos = more sections
   - Chunked videos may have timestamp gaps

### After Pasting

1. **Review Timestamps**
   - Verify they match important moments
   - Add your own bookmarks if needed

2. **Edit Summaries**
   - AI summaries are starting points
   - Add personal notes and context

3. **Organize Your Notes**
   - Create a database for multiple videos
   - Use tags and properties

## Troubleshooting

### Content Not Pasting Correctly

**Problem:** Formatting looks wrong after pasting

**Solutions:**
1. Try pasting as plain text first (`Ctrl+Shift+V`)
2. Clear Notion's format and re-paste
3. Use the HTML download and import

### Images Not Showing

**Problem:** Images appear broken or missing

**Solutions:**
1. Check if images were extracted (look in preview)
2. Try re-processing the video
3. Large data URLs may timeout - try downloading HTML

### Timestamps Incorrect

**Problem:** Timestamps don't match video content

**Solutions:**
1. For YouTube videos, ensure chunks processed correctly
2. Re-process with different video quality
3. Manually adjust timestamps in Notion

### Page Too Large

**Problem:** Notion page is slow or won't save

**Solutions:**
1. Split notes across multiple pages
2. Remove some frame images
3. Use lower quality frame extraction

## Future: Notion API Integration

When direct Notion integration is available, you'll be able to:

```
┌─────────────────────────────────────────┐
│         Future Integration              │
├─────────────────────────────────────────┤
│  Video to Notion                        │
│         ↓                               │
│  Connect Notion Account                 │
│         ↓                               │
│  Select Workspace & Page                │
│         ↓                               │
│  Automatic Page Creation                │
│         ↓                               │
│  Database Entry with Properties         │
│  - Video URL                            │
│  - Duration                             │
│  - Date processed                       │
│  - Tags                                 │
│         ↓                               │
│  Images uploaded to Notion              │
│         ↓                               │
│  Clickable timestamp links              │
└─────────────────────────────────────────┘
```

Stay tuned for updates!
