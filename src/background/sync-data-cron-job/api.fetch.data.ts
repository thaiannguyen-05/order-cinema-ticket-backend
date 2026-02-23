const BASE_URL = 'https://api-gate2.movieglu.com';

export const SORT_TYPE = {
  ALPHABETICAL: 'alphabetical',
  POPULARITY: 'popularity',
} as const;

export type SortType = (typeof SORT_TYPE)[keyof typeof SORT_TYPE];

export const MOVIE_GLU = {
  FILM_NOWSHOWING(params: number): string {
    return `${BASE_URL}/filmsNowShowing?n=${params}`;
  },
  CINEMA_NEARBY(params: number): string {
    return `${BASE_URL}/cinemasNearby?n=${params}`;
  },
  FILMS_COMING_SOON(params: number): string {
    return `${BASE_URL}/filmsComingSoon?n=${params}`;
  },
  FILMS_DETAIL(id: number): string {
    return `${BASE_URL}/filmDetails/?film_id=${id}`;
  },
  CINEMA_DETAIL(id: number): string {
    return `${BASE_URL}/cinemaDetails/?cinema_id=${id}`;
  },
  CINEMA_SHOWTIME(
    date: string,
    cinemaId: number,
    filmId?: number,
    sort?: SortType,
  ): string {
    const selectedSort = sort ?? SORT_TYPE.POPULARITY;
    const searchParams = new URLSearchParams({
      cinema_id: String(cinemaId),
      date,
      sort: selectedSort,
    });

    if (filmId !== undefined) {
      searchParams.set('film_id', String(filmId));
    }

    return `${BASE_URL}/cinemaShowTimes/?${searchParams.toString()}`;
  },
};
