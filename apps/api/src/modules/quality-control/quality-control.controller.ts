import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { QualityControlService } from './quality-control.service';

@Controller('quality-control')
@UseGuards(SessionGuard)
export class QualityControlController {
  constructor(private readonly qualityControl: QualityControlService) {}

  @Post('rfqs/:rfqId/accept')
  acceptQuote(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string) {
    return this.qualityControl.acceptQuote(user, rfqId);
  }
}
