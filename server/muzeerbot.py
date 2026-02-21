import discord
from discord import app_commands
from discord.ext import commands
import os
import aiohttp
import urllib.parse # NEEDED FOR URL ENCODING
from dotenv import load_dotenv

load_dotenv()

class MuzeerBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True 
        super().__init__(command_prefix="!", intents=intents)
        self.session = None

    async def setup_hook(self):
        self.session = aiohttp.ClientSession()
        await self.tree.sync()
        print(f"Bot is ready! Type !sync in your Discord server to load slash commands.")

bot = MuzeerBot()

@bot.tree.command(name="listening", description="See what you or a friend is listening to on Muzeer")
async def listening(interaction: discord.Interaction, target: discord.Member = None):
    print(f"DEBUG: /listening triggered by {interaction.user.name}") 
    await interaction.response.defer()

    # If target is specified, check them. Otherwise, check the user who ran the command.
    user_to_check = target or interaction.user
    api_url = f"{os.getenv('API_BASE_URL', 'http://127.0.0.1:3000/api/bot')}/listening/{user_to_check.id}"
    print(f"DEBUG: Fetching from {api_url}")

    try:
        async with bot.session.get(api_url) as response:
            if response.status == 404:
                print("DEBUG: User not found in DB")
                if target:
                    await interaction.followup.send(f"❌ {user_to_check.display_name} hasn't linked their Muzeer account yet!")
                else:
                    await interaction.followup.send("❌ Account not linked! Use `/link` to connect it.")
                return
            elif response.status != 200:
                print(f"DEBUG: API returned status {response.status}")
                await interaction.followup.send("⚠️ Muzeer API is unreachable.")
                return
            data = await response.json()
    except Exception as e:
        print(f"DEBUG: Connection error: {e}")
        await interaction.followup.send("⚠️ Failed to connect to API.")
        return

    username = data.get("userName", user_to_check.display_name)
    presence = data.get("presence", {})
    print(f"DEBUG: Success! Loaded profile for {username}") 

    embed = discord.Embed(title=f"🎧 {username}'s Profile", color=discord.Color.from_rgb(255, 180, 84))
    embed.set_thumbnail(url=user_to_check.display_avatar.url)

    if presence and presence.get("isPlaying"):
        title, artist, url = presence.get("title", "Unknown"), presence.get("artist", "Unknown"), presence.get("webpage_url", "")
        start_seconds = int(presence.get("startTimestamp", 0) / 1000)
        embed.add_field(name="Now Playing", value=f"**[{title}]({url})**\n👤 by {artist}\n\n⏱️ **Started:** <t:{start_seconds}:R>")
    else:
        embed.add_field(name="Now Playing", value="Not listening to anything right now.")

    await interaction.followup.send(embed=embed)


@bot.tree.command(name="link", description="Get your magic link to connect your Muzeer account")
async def link_account(interaction: discord.Interaction):
    print(f"DEBUG: /link triggered by {interaction.user.name}") 
    
    # 1. URL encode the username to handle spaces and special characters safely
    safe_name = urllib.parse.quote(interaction.user.name)
    
    # 2. Pass BOTH the ID and the Name in the URL
    magic_link = f"http://localhost:5173/profile?discordId={interaction.user.id}&discordName={safe_name}"
    
    embed = discord.Embed(
        title="🔗 Link your Muzeer Account",
        description="Click the link below to securely connect your Discord account to Muzeer.",
        color=discord.Color.from_rgb(59, 240, 209)
    )
    embed.add_field(name="Your Secure Link", value=f"**[Click here to link accounts]({magic_link})**", inline=False)
    
    # Ephemeral ensures ONLY the author sees this link, making it completely private
    await interaction.response.send_message(embed=embed, ephemeral=True)


@bot.command()
@commands.is_owner()
async def sync(ctx):
    print("DEBUG: !sync command triggered") 
    try:
        # THE FIX: This explicitly copies global slash commands to your test server
        bot.tree.copy_global_to(guild=ctx.guild)
        
        synced = await bot.tree.sync(guild=ctx.guild)
        await ctx.send(f"✅ Successfully synced {len(synced)} slash commands!")
        print(f"DEBUG: Synced {len(synced)} commands.")
    except Exception as e:
        await ctx.send(f"❌ Error syncing: {e}")
        print(f"DEBUG: Sync error: {e}")

if __name__ == "__main__":
    bot.run(os.getenv("DISCORD_TOKEN"))