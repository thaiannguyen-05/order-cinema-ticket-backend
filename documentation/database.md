## Database Schema

```mermaid
flowchart TD

    Cinema["Cinema
    - cinema_id (PK)
    - cinema_name
    - city"]

    Film["Film
    - film_id (PK)
    - film_name"]

    FilmOfCinema["FilmOfCinema
    - id (PK)
    - filmId (FK)
    - cinemaId (FK)"]

    Seat["Seat
    - id (PK)
    - row
    - column
    - filmId (FK)
    - cinemaId (FK)"]

    Ticket["Ticket
    - id (PK)
    - code
    - price
    - userId (FK)
    - filmOfCinemaId (FK)
    - seatId (FK)"]

    MomoPayment["MomoPayment
    - requestId (PK)
    - amount
    - userId (FK)
    - ticketId (FK)"]

    User["User
    - id (PK)
    - email"]

    Session["Session
    - id (PK)
    - userId (FK)"]

    Cinema --> FilmOfCinema
    Film --> FilmOfCinema

    FilmOfCinema --> Ticket
    Seat --> Ticket

    Cinema --> Seat
    Film --> Seat

    User --> Ticket
    User --> Session
    User --> MomoPayment

    Ticket --> MomoPayment