import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddEmailDto {
  @ApiProperty({ example: 'user@example.com', description: 'Real login email to attach to the account.' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
