import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SyncDataCronJobService {
  constructor(private readonly httpService: HttpService) {}
}
