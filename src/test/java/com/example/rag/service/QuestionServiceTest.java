package com.example.rag.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.vectorstore.VectorStore;

class QuestionServiceTest {
 @Test void returnsUnknownWhenNoEvidence() {
  VectorStore store=mock(VectorStore.class);
  ChatModel model=mock(ChatModel.class);
  when(store.similaritySearch(any(org.springframework.ai.vectorstore.SearchRequest.class))).thenReturn(List.of());
  var chatId = UUID.randomUUID();
  var response=new QuestionService(store,model,5,0.65).ask(chatId, "Unsupported question");
  assertEquals("I don't know based on the uploaded documents.",response.answer());
  assertTrue(response.sources().isEmpty());
  var request = org.mockito.ArgumentCaptor.forClass(org.springframework.ai.vectorstore.SearchRequest.class);
  verify(store).similaritySearch(request.capture());
  assertEquals(
          new org.springframework.ai.vectorstore.filter.FilterExpressionBuilder()
                  .eq("chatId", chatId.toString()).build(),
          request.getValue().getFilterExpression()
  );
  verify(model, never()).call(any(org.springframework.ai.chat.prompt.Prompt.class));
 }
}
