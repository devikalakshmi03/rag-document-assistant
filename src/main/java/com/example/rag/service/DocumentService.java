package com.example.rag.service;

import com.example.rag.dto.DocumentResponse;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.ai.document.Document;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {
 private final VectorStore store;
 private final JdbcTemplate jdbc;
 public DocumentService(VectorStore store,JdbcTemplate jdbc){this.store=store;this.jdbc=jdbc;}

 public DocumentResponse upload(UUID chatId, MultipartFile file) throws IOException {
  if(file.isEmpty() || file.getSize()>20_000_000) throw new IllegalArgumentException("PDF must be nonempty and under 20 MB");
  byte[] bytes=file.getBytes();
  if(bytes.length<5 || bytes[0]!='%' || bytes[1]!='P' || bytes[2]!='D' || bytes[3]!='F' || bytes[4]!='-') throw new IllegalArgumentException("Invalid PDF file");
  String digest=sha256(bytes);
  if(!jdbc.queryForList("SELECT id FROM uploaded_documents WHERE chat_id=? AND sha256=?",String.class,chatId,digest).isEmpty()) throw duplicatePdf();
  UUID id=UUID.randomUUID();
  String filename=file.getOriginalFilename()==null?"document.pdf":file.getOriginalFilename().replaceAll("[\\r\\n\\t]","_");
  List<Document> chunks=new ArrayList<>(); int pages;
  try(var pdf=Loader.loadPDF(bytes)) {
   pages=pdf.getNumberOfPages();
   if(pages>500) throw new IllegalArgumentException("Maximum 500 pages per PDF");
   var stripper=new PDFTextStripper();
   var splitter=new TokenTextSplitter(800,150,5,10000,true);
   for(int page=1;page<=pages;page++) {
    stripper.setStartPage(page);stripper.setEndPage(page);
    String text=stripper.getText(pdf);
    if(text.isBlank()) continue;
    Document source=new Document(text,Map.of("chatId",chatId.toString(),"documentId",id.toString(),"filename",filename,"page",page));
    chunks.addAll(splitter.apply(List.of(source)));
   }
  }
  if(chunks.isEmpty()) throw new IllegalArgumentException("No extractable text found (scanned PDFs require OCR)");
  // Metadata is written only after vector insertion succeeds. Failed inserts can be retried.
  store.add(chunks);
  try {
   jdbc.update("INSERT INTO uploaded_documents(id,filename,sha256,page_count,chunk_count,chat_id) VALUES (?,?,?,?,?,?)",id,filename,digest,pages,chunks.size(),chatId);
  } catch(RuntimeException e) {
   store.delete(chunks.stream().map(Document::getId).toList());
   if (e instanceof DuplicateKeyException) throw duplicatePdf();
   throw e;
  }
  return new DocumentResponse(id,filename,pages,chunks.size());
 }
 private static DuplicateKeyException duplicatePdf() {
  return new DuplicateKeyException("This PDF is already uploaded in this chat.");
 }

 public List<DocumentResponse> list(UUID chatId){
  return jdbc.query("SELECT id,filename,page_count,chunk_count FROM uploaded_documents WHERE chat_id=? ORDER BY created_at DESC",(rs,n)->new DocumentResponse(rs.getObject(1,UUID.class),rs.getString(2),rs.getInt(3),rs.getInt(4)),chatId);
 }
 @Transactional
 public void delete(UUID chatId, UUID id){
  int count=jdbc.update("DELETE FROM uploaded_documents WHERE id=? AND chat_id=?",id,chatId);
  if(count==0) throw new IllegalArgumentException("Document not found");
  // Vector deletion uses the indexed documentId metadata field.
  store.delete("documentId == '"+id+"'");
 }
 private static String sha256(byte[] bytes){
  try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
  catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
 }
}
