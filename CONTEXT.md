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
A pairing of one Film with one Cinema in which seats and tickets can be sold.
_Avoid_: Showtime, Screening, Schedule, Show

**Seat**:
A numbered position (row, column) sellable for one FilmOfCinema at one Cinema.
_Avoid_: Chair, Slot

### Ordering

**Ticket**:
An entitlement to one Seat for one FilmOfCinema.
_Avoid_: Booking, Reservation

**Order**:
A User's request to acquire one Ticket.
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
