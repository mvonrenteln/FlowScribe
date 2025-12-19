## Functional and Quality Requirements (Revised)

### Core Functionality (Version 1.0) - _Single Audio/Transcript Focus_

|ID|Requirement Category|Description|
|---|---|---|
|**F1.0**|**Import & I/O**|The application must load **one** audio file and its corresponding WhisperX JSON Transcript file (initially, multiple versions allowed for selection).|
|**F1.1**|**Visual Output**|Simultaneous, synchronized display of the **single audio waveform** and the transcript text.|
|**F1.2**|**Diarization Visualization**|Speaker assignment must be visualized via distinctively colored segments (regions/blocks) on the waveform.|
|**F1.3**|**Text Format**|Initial output format of the transcript must include **Speaker Tags** (e.g., `[Speaker Name] Text...`).|
|**F1.4**|**Initial Segmentation**|The initial block assignment (Diarization) uses the **Sentence/Block-level** time stamps provided by WhisperX.|
|**F1.5**|**Speaker Assignment**|The user must be able to change the speaker assignment for any selected segment at any time.|
|**F1.6**|**Transcript Editing**|The full text of the transcript must be directly editable by the user.|
|**F1.7**|**Version Management**|The user must be able to select the correct version when multiple WhisperX transcripts are loaded for the single audio file.|
|**F1.8**|**Metadata Management**|The user must be able to edit (rename) and add new speaker names for the current project.|
|**F1.9**|**Export Format**|The final, edited transcript must be exportable in a standard text format including speaker tags and time stamps.|
### Segment Manipulation Tools (Waveform & Text Flow)

| ID       | Tool Function         | Description                                                                                                                                      | Interaction Granularity |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| **M1.0** | **Segment Selection** | Users must be able to select a segment (block) by clicking the text or the segment region in the waveform.                                       | Segment/Word            |
| **M1.1** | **Split Segment**     | Users must be able to **split** an existing segment into two new segments at a precise location, editable down to the **Word-level** time stamp. | Word                    |
| **M1.2** | **Merge Segments**    | Users must be able to **merge** two or more consecutive segments into a single new segment.                                                      | Segment                 |
| **M1.3** | **Adjust Boundaries** | Users must be able to adjust segment start/end times by drag-and-drop on the waveform boundaries.                                                | Waveform/Segment        |
| **M1.4** | **Delete Segment**    | Users must be able to delete an entire segment/block.                                                                                            | Segment                 |
### Quality and Workflow Requirements

|ID|Requirement Type|Description|
|---|---|---|
|**Q1.0**|**Usability (UX)**|The application must prioritize **simplicity, intuitive interaction, and ease of use**.|
|**Q1.1**|**Workflow**|The workflow must be seamless, allowing the user to work fluently between the **Waveform level** and the **Transcript Text level** without changing modes.|
|**Q1.2**|**Accessibility**|All core functional interactions must be accessible and executable via **text-based keyboard shortcuts** (Pro-User Focus).|
|**Q1.3**|**Speaker Persistence**|**Speaker names** are **not** to be saved or reused automatically across different projects. They are local to the current project/session.|