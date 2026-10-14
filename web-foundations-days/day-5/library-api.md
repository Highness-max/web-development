# Library API — Books Resource

A REST API design for a library's **books** resource. All requests and
responses use JSON. All endpoints require HTTPS and a valid
`Authorization: Bearer <token>` header unless stated otherwise.

Base URL: `https://api.mylibrary.com`

---

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns every book in the library.
- **Request body:** none
- **Success status:** `200 OK`
- **Example response:**

```json
[
  {
    "id": 1,
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "year": 1958,
    "available": true
  },
  {
    "id": 2,
    "title": "Half of a Yellow Sun",
    "author": "Chimamanda Ngozi Adichie",
    "year": 2006,
    "available": false
  }
]
```
