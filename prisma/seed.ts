import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create categories
  const categories = [
    {
      name: 'Design',
      slug: 'design',
      description: 'Discuss UI/UX design, graphics, and creative concepts',
      icon: '🎨',
      order: 1,
    },
    {
      name: 'Education',
      slug: 'education',
      description: 'Share knowledge, tutorials, and learning resources',
      icon: '📚',
      order: 2,
    },
    {
      name: 'Art',
      slug: 'art',
      description: 'Showcase artwork, digital art, and creative expression',
      icon: '🖼️',
      order: 3,
    },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    })
    console.log(`✓ Created/Updated category: ${category.name}`)
  }

  console.log('✅ Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
