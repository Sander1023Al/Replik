# Replik

![Replik Logo](./public/logo.png)

**Replik** is a specialized, open-source audio recording tool designed specifically for game developers, voice actors, and content creators who need to manage and record extensive dialogue scripts efficiently.

## The Problem
In game development and animation production, voice recording is often a fragmented process. Developers work with spreadsheets containing thousands of dialogue lines, while voice actors often record long takes that need to be manually split, named, and organized later. This "post-recording hell" consumes valuable time and introduces human error in file naming and asset management.

## The Solution
**Replik** bridges the gap between the script and the recording booth. By importing your dialogue script (CSV/JSON), Replik transforms the recording process into a structured workflow:

1.  **Script-Driven Recording:** Lines are presented one by one, ensuring no dialogue is missed.
2.  **Auto-Naming:** Files are automatically named according to your project's convention (e.g., `Character_Emotion_LineID_Take1.wav`) the moment you stop recording.
3.  **Instant File Splitting:** No need to slice a 1-hour waveform into 500 files. Every take is already a separate file.
4.  **Metadata Management:** Automatically generates metadata sidecars for integration with game engines (Unity, Unreal, Godot).

## Key Features
-   **Script Import:** Support for CSV and JSON formats with customizable field mapping.
-   **Take Management:** Multiple takes per line, easy review, and selection.
-   **Audio Processing:** Built-in tools to **Remove Silence**, **Denoise**, add **Echo** or **Distortion** using FFmpeg.
-   **Export:** Batch export organized files ready for game engine import.
-   **Cross-Platform:** Built on Electron, compatible with Windows, macOS, and Linux.

## Installation

### From Source
1.  Clone the repository:
    ```bash
    git clone https://github.com/edgetype/replik.git
    cd replik
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run electron:dev
    ```

## Usage
1.  **Import:** Drag and drop your dialogue script. Map your columns (Text, Character, Emotion, ID).
2.  **Record:** Press `Space` to record. Press `Space` again to stop.
3.  **Review:** Press `P` to play back the last take.
4.  **Edit:** Click the wand icon to refine audio (trim silence, etc.).
5.  **Next:** Use `Right Arrow` to move to the next line.
6.  **Export:** When finished, click "Export" to get a clean folder of assets.

## License
This project is licensed under the **MIT License**. You are free to use it for personal and commercial projects. See the [LICENSE](LICENSE) file for details.
