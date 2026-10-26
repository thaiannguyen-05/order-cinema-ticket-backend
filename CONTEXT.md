# Cinema Ticket Ordering

Backend for browsing films and cinemas and ordering tickets for seats. Single context covering catalog, ordering, identity, and discovery.

## Language

### Catalog

**Film**:
A movie available for showing, identified by Glu `film_id`, with title, trailer, images, release dates and age rating.
_Avoid_: Movie

**Cinema**:
A physical venue where films are shown.
_Avoid_: Theater

**FilmOfCinema**:
A pairing of one Film with one Cinema that can be scheduled as showtimes. No dedicated table lifecycle beyond the pairing itself.
_Avoid_: Showtime, Screening, Schedule, Show

**Room**:
A physical hall inside one Cinema that holds Seats and hosts ShowTimes.
_Avoid_: Hall, Auditorium, Theater

**ShowTime**:
One screening of a FilmOfCinema in a Room, with start/end time and base price.
_Avoid_: Screening, Schedule, Session

**Seat**:
A numbered position (row, column) in one Room, reusable across ShowTimes. `seatStatus` is only for maintenance (`NOT_AVAILABLE`), never for booking.
_Avoid_: Chair, Slot

### Ordering

**Ticket**:
An entitlement to one Seat for one ShowTime, with its own price and `ticketStatus` (`AVAILABLE` -> `PROCESSING` -> `BOOKED`, back to `AVAILABLE` on `FAILED`/`CANCELLED`/`EXPIRED`).
_Avoid_: Booking, Reservation

**Order**:
A User's request to acquire one Ticket (1-1, FK on `Order.ticketId`). Only Sepay IPN may move it to `PAID`/`FAILED`. `OrderStatus` is `PENDING`/`PAID`/`FAILED`/`EXPIRED`/`CANCELLED`.
_Avoid_: Booking, Reservation, Purchase

**Payment**:
Settlement of money for Orders, recorded on `Order` itself (`paidAmount`, `paymentMethod`, `callbackPayload`). There is no separate `Payment` table.
_Avoid_: Transaction, Bill

**CheckoutForm**:
Signed browser form (action + fields) BE builds for one Order so the caller POSTs to SePay checkout/init. SePay replies 302, never JSON `checkout_url`. Transient, never stored.
_Avoid_: CheckoutUrl

**SepayNotification**:
JSON IPN SePay calls to BE webhook; only path that may move Order to `PAID`/`FAILED`. Transient, never stored as an entity.
_Avoid_: Callback

### Identity

**User**:
A person with an account, either a regular buyer or an administrator.
_Avoid_: Customer, Member, Account, Client

**Session**:
An authenticated login of one User from one IP address. One User may hold several Sessions (bounded, LRU-evicted).
_Avoid_: Showtime session, Screening

**AuthenticationFailure**:
A rejected login or token refresh that exposes one fixed message regardless of internal cause.
_Avoid_: Invalid credentials, Invalid login

### Discovery (defined, not yet implemented)

**EventTracking**:
A record of one User interaction with the product.
_Avoid_: Log, Event, Analytics

**UserRecommendation**:
A ranked Film suggestion for one User.
_Avoid_: Suggestion, Favorite
