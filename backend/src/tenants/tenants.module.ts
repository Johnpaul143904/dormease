import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
