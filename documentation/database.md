# Database Schema

## ER Diagram (DBML)

```dbml
Enum VERSION_TYPE {
  STANDARD
  DOLBY_CINEMA
  IMAX
}

Enum ACCOUNT_STATUS {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING
}

Enum TICKET_STATUS {
  BOOKED
  CANCELLED
  AVAILABLE
  USED
}

Enum PAYMENT_STATUS {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

Enum SEAT_STATUS {
  AVAILABLE
  BOOKED
  OCCUPIED
}

Table User {
  id uuid [pk]
  fullname text
  email text [unique]
  isActive boolean
  hashPassword text
  dateOfBirth timestamp
  address text
  status ACCOUNT_STATUS
  createdAt timestamp
  updatedAt timestamp
  deletedAt timestamp

  Indexes {
    email
  }
}

Table Session {
  id uuid [pk]
  userId uuid
  hashRefreshToken text
  userIp text [unique]
  createdAt timestamp
  updatedAt timestamp

  Indexes {
    userId
    (userId, userIp) [unique]
  }
}

Table Cinema {
  cinema_id int [pk]
  cinema_name text
  address text
  address2 text
  city text
  country text
  postcode text
  phone text
  logo_url text
  createdAt timestamp
  updatedAt timestamp
}

Table Film {
  film_id int [pk]
  film_name text
  other_title json
  release_dates json
  age_rating json
  trailers json
  synopsis_long text
  images json
  version_type VERSION_TYPE
  duration_mins int
  review_stars float
  review_txt text
  distributor text
  genres json
  cast json
  directors json
  producers json
  writers json
}

Table FilmOfCinema {
  id uuid [pk]
  filmId int
  cinemaId int

  Indexes {
    (filmId, cinemaId) [unique]
  }
}

Table Seat {
  id uuid [pk]
  row int
  column int
  status SEAT_STATUS
  filmId uuid
  cinemaId int [unique]

  Indexes {
    (filmId, cinemaId)
  }
}

Table Ticket {
  id uuid [pk]
  code text
  price double
  createdAt timestamp
  updatedAt timestamp
  userId uuid
  filmOfCinemaId uuid
  seatId uuid [unique]
  status TICKET_STATUS

  Indexes {
    (userId, seatId)
  }
}

Table MomoPayment {
  requestId text [pk]
  partnerCode text
  partnerName text
  storeId text
  amount decimal
  orderId text
  orderInfo text
  autoCapture boolean
  redirectUrl text
  ipnUrl text
  requestType text
  extraData text
  lang text
  signature text
  userId uuid
  paymentStatus PAYMENT_STATUS
  ticketId uuid [unique]
  createdAt timestamp
  updatedAt timestamp
}