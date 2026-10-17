# Cinema Ticket Ordering

Backend for browsing films and cinemas and ordering tickets for seats. Single context covering catalog, ordering, identity, and discovery.

## Language

### Catalog

**Film**:
A movie available for showing, with title, duration, and version type.
_Avoid_: Movie

**Cinema**:
A physical venue where films are shown.
_Avoid_: Theater

**FilmOfCinema**:
A pairing of one Film with one Cinema that can be scheduled as showtimes.
_Avoid_: Showtime, Screening, Schedule, Show

**Room**:
A physical hall inside one Cinema that holds Seats and hosts ShowTimes.
_Avoid_: Hall, Auditorium, Theater

**ShowTime**:
One screening of a FilmOfCinema in a Room, with start/end time and base price.
_Avoid_: Screening, Schedule, Session

**Seat**:
A numbered position (row, column) in one Room, reusable across ShowTimes. `seatStatus` is only for maintenance (NOT*AVAILABLE), never for booking.
\_Avoid*: Chair, Slot

### Ordering

**Ticket**:
An entitlement to one Seat for one ShowTime, with its own price and `ticketStatus` (AVAILABLE -> PROCESSING -> BOOKED, back to AVAILABLE on FAILED/CANCELLED/EXPIRED).
_Avoid_: Booking, Reservation

**Order**:
A User's request to acquire one Ticket (1-1, FK on `Order.ticketId`). Only Sepay IPN may move it to PAID/FAILED.
_Avoid_: Booking, Reservation, Purchase

**Payment**:
Settlement of money for Orders.
_Avoid_: Transaction, Bill

### Identity

**User**:
A person with an account, either a regular buyer or an administrator.
_Avoid_: Customer, Member, Account, Client

**Session**:
An authenticated login of one User from one IP address.
_Avoid_: Showtime session, Screening

**AuthenticationFailure**:
A rejected login or token refresh that exposes one fixed message regardless of internal cause.
_Avoid_: Invalid credentials, Invalid login

### Discovery

**EventTracking**:
A record of one User interaction with the product.
_Avoid_: Log, Event, Analytics

**UserRecommendation**:
A ranked Film suggestion for one User.
_Avoid_: Suggestion, Favorite
