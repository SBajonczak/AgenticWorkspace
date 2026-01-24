import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
  await prisma.jiraSync.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.meeting.deleteMany()

  // Create demo meeting
  const meeting = await prisma.meeting.create({
    data: {
      meetingId: 'demo-meeting-001',
      title: 'Q1 Product Planning',
      organizer: 'Sarah Chen',
      organizerEmail: 'sarah.chen@company.com',
      startTime: new Date('2026-01-20T14:00:00Z'),
      endTime: new Date('2026-01-20T15:00:00Z'),
      transcript: `[00:00] Sarah Chen: Good afternoon everyone. Let's kick off our Q1 planning session.

[00:30] Michael Torres: Thanks Sarah. I think we need to prioritize the mobile app redesign this quarter.

[01:15] Sarah Chen: Agreed. Michael, can you draft the technical specifications by end of this week?

[01:30] Michael Torres: Yes, I'll have that ready by Friday.

[02:00] Jessica Park: We should also address the API performance issues our customers have been reporting.

[02:30] Sarah Chen: Good point. Jessica, please investigate the root cause and present findings in our next sprint planning.

[02:45] Jessica Park: I'll do that. I'll schedule a deep dive with the backend team.

[03:15] David Liu: What about the analytics dashboard? Several enterprise clients are waiting for that.

[03:45] Sarah Chen: Let's target that for mid-Q1. David, work with the design team to finalize the mockups by January 31st.

[04:00] David Liu: Will do.

[04:30] Sarah Chen: One more thing - we need to update our technical documentation. It's gotten stale.

[05:00] Michael Torres: I can coordinate that effort. I'll set up a documentation sprint.

[05:20] Sarah Chen: Perfect. Alright, I think we have our action items. Thanks everyone!`,
      summary: `The team held their Q1 product planning session to prioritize key initiatives. The mobile app redesign was identified as the top priority for the quarter. The team also discussed addressing API performance issues that customers have been experiencing. An analytics dashboard was planned for mid-Q1 delivery to meet enterprise client needs. Technical documentation updates were recognized as necessary and will be coordinated through a dedicated documentation sprint. The meeting resulted in clear ownership and deadlines for each initiative.`,
      decisions: JSON.stringify([
        'Mobile app redesign will be the top priority for Q1',
        'Analytics dashboard targeted for mid-Q1 release',
        'Technical documentation will be updated through a dedicated sprint'
      ]),
      processedAt: new Date(),
    },
  })

  // Create demo todos
  const todos = await prisma.todo.createMany({
    data: [
      {
        meetingId: meeting.id,
        title: 'Draft technical specifications for mobile app redesign',
        description: 'Create comprehensive technical specifications document covering architecture, components, and implementation approach. Due by end of week (Friday).',
        assigneeHint: 'Michael Torres',
        confidence: 0.9,
        status: 'pending',
      },
      {
        meetingId: meeting.id,
        title: 'Investigate API performance issues root cause',
        description: 'Analyze customer-reported API performance issues, identify bottlenecks, and present findings in next sprint planning. Schedule deep dive session with backend team.',
        assigneeHint: 'Jessica Park',
        confidence: 0.9,
        status: 'pending',
      },
      {
        meetingId: meeting.id,
        title: 'Finalize analytics dashboard mockups',
        description: 'Work with design team to complete mockups for enterprise analytics dashboard. Deadline: January 31st.',
        assigneeHint: 'David Liu',
        confidence: 0.9,
        status: 'pending',
      },
      {
        meetingId: meeting.id,
        title: 'Coordinate documentation sprint',
        description: 'Set up and coordinate a documentation sprint to update technical documentation that has become outdated.',
        assigneeHint: 'Michael Torres',
        confidence: 0.85,
        status: 'pending',
      },
    ],
  })

  console.log(`✅ Created ${todos.count} demo todos for meeting: ${meeting.title}`)
  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
