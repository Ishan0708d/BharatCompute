import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.node.createMany({
    data: [
      { name: "Node-001", type: "A100", totalGpus: 16, usedGpus: 8, temperature: 72, power: 320, status: "online" },
      { name: "Node-002", type: "A100", totalGpus: 16, usedGpus: 16, temperature: 81, power: 400, status: "online" },
      { name: "Node-003", type: "H100", totalGpus: 8, usedGpus: 0, temperature: 58, power: 210, status: "online" },
      { name: "Node-004", type: "H100", totalGpus: 8, usedGpus: 0, temperature: 0, power: 0, status: "offline" },
    ],
  })

  await prisma.job.create({
    data: { name: "GPT-4 Finetune", framework: "PyTorch", gpus: 8, status: "running" }
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    throw e
  })
