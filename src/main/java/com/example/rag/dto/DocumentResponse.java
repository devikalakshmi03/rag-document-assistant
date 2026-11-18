package com.example.rag.dto;
import java.util.UUID;
public record DocumentResponse(UUID id,String filename,int pages,int chunks) {}
