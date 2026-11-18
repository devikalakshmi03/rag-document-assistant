package com.example.rag.exception;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
@RestControllerAdvice
public class ApiExceptionHandler {
 @ExceptionHandler(DuplicateKeyException.class)
 public ResponseEntity<Map<String,String>> duplicate(DuplicateKeyException e){
  return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
          "code","PDF_ALREADY_UPLOADED",
          "error","This PDF is already uploaded in this chat."
  ));
 }
 @ExceptionHandler(IllegalArgumentException.class)
 public ResponseEntity<Map<String,String>> badRequest(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("error",e.getMessage()));}
 @ExceptionHandler(MethodArgumentNotValidException.class)
 public ResponseEntity<Map<String,String>> invalid(MethodArgumentNotValidException e){return ResponseEntity.badRequest().body(Map.of("error","Invalid question"));}
}
