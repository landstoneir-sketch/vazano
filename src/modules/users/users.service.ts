import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateProfileDto } from './update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, mobile: true, email: true, firstName: true, lastName: true, locale: true, status: true, createdAt: true } });
  }
  async update(id: string, input: UpdateProfileDto) {
    try {
      return await this.prisma.user.update({ where: { id }, data: input, select: { id: true, mobile: true, email: true, firstName: true, lastName: true, locale: true, status: true } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('این ایمیل قبلاً ثبت شده است.');
      throw error;
    }
  }
}
