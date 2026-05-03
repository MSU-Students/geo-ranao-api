import { ApiProperty } from "@nestjs/swagger";

export class ProfileDto {
    @ApiProperty()
    id: number;
    @ApiProperty()
    username: string;
}