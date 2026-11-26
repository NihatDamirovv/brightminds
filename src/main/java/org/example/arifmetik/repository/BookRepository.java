package org.example.arifmetik.repository;

import java.util.List;

import org.example.arifmetik.model.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface BookRepository extends JpaRepository<Book, Long> {

  @Query("select b.id as id, b.title as title, b.author as author, b.fileName as fileName from Book b")
  List<BookSummaryProjection> findAllSummaries();

  interface BookSummaryProjection {
    Long getId();
    String getTitle();
    String getAuthor();
    String getFileName();
  }
}
