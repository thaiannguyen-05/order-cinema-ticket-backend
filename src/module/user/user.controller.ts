import { Body, Controller, Put, Req } from '@nestjs/common';
import { UserService } from './user.service';
import type { Request } from 'express';
import type { UpdateUser } from './dto/update.user.dto';
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Put('update')
  async updateUser(@Req() req: Request, @Body() dto: UpdateUser) {
    const email = req.payload?.email;
    dto.email = email!;
    return this.userService.updateUserByEmail(dto);
  }
}
