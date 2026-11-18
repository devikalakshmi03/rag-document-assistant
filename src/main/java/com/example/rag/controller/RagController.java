package com.example.rag.controller;
import com.example.rag.dto.*;
import com.example.rag.service.*;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController
@RequestMapping("/api/v1")
public class RagController {
 private static final String LEGACY_CHAT = "00000000-0000-0000-0000-000000000000";
 private final DocumentService docs;private final QuestionService questions;
 public RagController(DocumentService docs,QuestionService questions){this.docs=docs;this.questions=questions;}
 @PostMapping(value="/documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 @ResponseStatus(HttpStatus.CREATED)
 public DocumentResponse upload(@RequestParam(defaultValue = LEGACY_CHAT) UUID chatId, @RequestPart("file") MultipartFile file)throws IOException{return docs.upload(chatId, file);}

    
@PostMapping(
    value = "/documents/batch",
    consumes = MediaType.MULTIPART_FORM_DATA_VALUE
)
public BatchUploadResult uploadMultiple(
        @RequestParam(defaultValue = LEGACY_CHAT) UUID chatId,
        @RequestPart("files") MultipartFile[] files
) {

    if (files.length == 0 || files.length > 40) {
        throw new org.springframework.web.server.ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Please upload between 1 and 40 PDF files."
        );
    }

    List<BatchUploadResult.FileUploadResult> results =
            new java.util.ArrayList<>();

    int successful = 0;
    int failed = 0;

    for (MultipartFile file : files) {
        String filename = file.getOriginalFilename();

        try {
            DocumentResponse document = docs.upload(chatId, file);

            results.add(
                new BatchUploadResult.FileUploadResult(
                    filename,
                    true,
                    document,
                    null
                )
            );

            successful++;

        } catch (Exception e) {

            results.add(
                new BatchUploadResult.FileUploadResult(
                    filename,
                    false,
                    null,
                    e.getMessage()
                )
            );

            failed++;
        }
    }

    return new BatchUploadResult(
        files.length,
        successful,
        failed,
        results
    );
}

 @GetMapping("/documents") public List<DocumentResponse> list(@RequestParam(defaultValue = LEGACY_CHAT) UUID chatId){return docs.list(chatId);}
 @DeleteMapping("/documents/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
 public void delete(@RequestParam(defaultValue = LEGACY_CHAT) UUID chatId, @PathVariable UUID id){docs.delete(chatId, id);}
 @PostMapping("/ask") public AskResponse ask(@RequestParam(defaultValue = LEGACY_CHAT) UUID chatId, @Valid @RequestBody AskRequest request){return questions.ask(chatId, request.question());}
}
