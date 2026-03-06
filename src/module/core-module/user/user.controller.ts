import { Body, Controller, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { UpdateUser } from './dto/update.user.dto';
import { UserService } from './user.service';
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('update')
  async updateUser(@Req() req: Request, @Body() dto: UpdateUser) {
    const email = req.payload?.email;
    dto.email = email!;
    return this.userService.updateUserByEmail(dto);
  }
}
