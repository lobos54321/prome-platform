# ProMe Platform Deployment Guide

## Overview

This guide will walk you through setting up the ProMe platform with Supabase as the backend database and deploying to Zeabur.

## 1. Setting Up Supabase

### 1.1 Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign up or log in
2. Create a new project with your preferred settings
3. Once the project is created, note down the following credentials:
   - Supabase URL (found in Project Settings > API)
   - Supabase Anonymous Key (found in Project Settings > API)

### 1.2 Set Up Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Create a new query and paste the contents of `supabase/migrations/20250721_init_schema.sql`
3. Run the query to set up your database schema and initial data

## 2. Configuration

### 2.1 Environment Variables

1. Create a `.env` file in the root directory by copying `.env.example`
2. Fill in the environment variables with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Deploying to Zeabur

### 3.1 Prepare for Deployment

1. Make sure your code is pushed to a Git repository
2. Ensure you have the `zeabur.json` file in your repository

### 3.2 Deploy on Zeabur

1. Sign up or log in to [Zeabur](https://zeabur.com/)
2. Create a new project
3. Connect your Git repository
4. Set environment variables:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase Anonymous Key
5. Deploy the application

### 3.3 Configure Custom Domain (Optional)

1. Go to your project settings in Zeabur
2. Add a custom domain
3. Follow the instructions to set up DNS records

## 4. Post-Deployment Setup

### 4.1 Create Admin User

1. Register a new user through the application
2. Go to your Supabase dashboard > Table editor > users
3. Find your user and change the `role` column from `user` to `admin`

### 4.2 Configure Webhook

1. Log in as an admin user
2. Go to Admin > Webhook Configuration
3. Generate a new API key for enhanced security
4. Use this API key for your Dify integration

## 5. Testing the Deployment

1. Make sure you can register and log in
2. Check that you can view services and pricing
3. Test the webhook functionality if applicable

## Troubleshooting

- **Authentication Issues**: Make sure your Supabase URL and Anonymous Key are correct
- **Database Issues**: Check the SQL queries and make sure they executed successfully
- **Deployment Issues**: Verify the environment variables are set correctly in Zeabur

## Support

For any issues or questions, please contact support@prome.ai