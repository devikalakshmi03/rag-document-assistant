package com.example.rag.dto;

import java.util.List;

public record BatchUploadResult(
        int total,
        int successful,
        int failed,
        List<FileUploadResult> files
) {
    public record FileUploadResult(
            String filename,
            boolean success,
            DocumentResponse document,
            String error
    ) {}
}