package com.example.rag.dto;
import java.util.UUID;
public record Source(UUID documentId,String filename,int page,String excerpt,double score) {}
