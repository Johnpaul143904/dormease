import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { AssignmentsService } from './assignments.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma/enums';

@Roles(UserRole.ADMIN, UserRole.STAFF)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}
  @Get()
  findAll() { return this.assignmentsService.findAll(); }
  @Post()
  create(@Body() dto: CreateAssignmentDto) { return this.assignmentsService.create(dto); }
  @Patch(':id/terminate')
  terminate(@Param('id', ParseIntPipe) id: number) { return this.assignmentsService.terminate(id); }
}
