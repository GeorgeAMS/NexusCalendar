import { Injectable } from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RoomDto {
  id: string;
  name: string;
  slug: string;
  locationNote: string | null;
  isActive: boolean;
}

export function toRoomDto(room: Room): RoomDto {
  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    locationNote: room.locationNote,
    isActive: room.isActive,
  };
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<{ items: RoomDto[] }> {
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return { items: rooms.map(toRoomDto) };
  }
}
