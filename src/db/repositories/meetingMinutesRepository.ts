import { prisma } from '../prisma'
import { MeetingMinutes } from '@prisma/client'

export class MeetingMinutesRepository {
  async upsert(meetingId: string, language: string, content: string): Promise<MeetingMinutes> {
    return prisma.meetingMinutes.upsert({
      where: {
        meetingId_language: { meetingId, language },
      },
      update: { content },
      create: { meetingId, language, content },
    })
  }

  async findByMeetingId(meetingId: string): Promise<MeetingMinutes[]> {
    return prisma.meetingMinutes.findMany({
      where: { meetingId },
      orderBy: { language: 'asc' },
    })
  }

  async findByMeetingIdAndLanguage(
    meetingId: string,
    language: string
  ): Promise<MeetingMinutes | null> {
    return prisma.meetingMinutes.findUnique({
      where: {
        meetingId_language: { meetingId, language },
      },
    })
  }

  async deleteByMeetingId(meetingId: string): Promise<void> {
    await prisma.meetingMinutes.deleteMany({ where: { meetingId } })
  }
}
