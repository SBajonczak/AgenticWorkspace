import { test, expect } from '@playwright/test'

test.describe('Agentic Workspace UI', () => {
  test('homepage should load', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Check for hero heading
    await expect(page.getByRole('heading', { name: /Agentic Workplace/i })).toBeVisible()
    
    // Check for CTA buttons
    await expect(page.getByRole('link', { name: /View Dashboard/i })).toBeVisible()
  })

  test('dashboard should show demo data', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard')
    
    // Wait for data to load
    await page.waitForTimeout(1000)
    
    // Check for meeting data or empty state
    const hasMeetingData = await page.getByText(/Q1 Product Planning/i).isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/No meetings processed/i).isVisible().catch(() => false)
    
    expect(hasMeetingData || hasEmptyState).toBe(true)
  })

  test('navigation should work', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Navigate to dashboard
    await page.click('text=View Dashboard')
    await expect(page).toHaveURL(/.*dashboard/)
    
    // Navigate back to home
    await page.click('text=Home')
    await expect(page).toHaveURL('http://localhost:3000/')
  })
})
