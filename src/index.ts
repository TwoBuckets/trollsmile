import { verifyKey } from "discord-interactions"
import * as commands from "./commands"
import { APIInteraction, InteractionType, InteractionResponseType } from "discord-api-types/v10"

export interface Env {
	DISCORD_PUBLIC_KEY: string
}

function json(data: any, init?: ResponseInit): Response {
	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json;charset=utf-8",
		},
		...init,
	})
}
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method !== "POST") return new Response("Method not allowed", { status: 405 })

		const signature = request.headers.get("X-Signature-Ed25519")
		const timestamp = request.headers.get("X-Signature-Timestamp")
		if (!signature || !timestamp) return new Response("Missing signature", { status: 400 })

		const requestBody = await request.arrayBuffer()
		if (!verifyKey(requestBody, signature, timestamp, env.DISCORD_PUBLIC_KEY)) return new Response("Not authorized", { status: 401 })

		const interaction = JSON.parse(new TextDecoder().decode(requestBody)) as APIInteraction

		console.log(interaction)

		// The `PING` message is used during the initial webhook handshake, and is
		// required to configure the webhook in the developer portal.
		if (interaction.type === InteractionType.Ping) {
			return json({
				type: InteractionResponseType.Pong,
			})
		}

		if (interaction.type === InteractionType.ApplicationCommand) {
			// @ts-ignore
			try {
				return json(await Object.values(commands).find((c) => c.name === interaction.data.name)?.run(interaction))
			} catch (e) {
				console.log("Something went wrong", e)
				return json({
					type: InteractionResponseType.ChannelMessageWithSource,
					data: {
						embeds: [
							{
								title: "An error occurred",
								description: "```\n" + e + "\n```",
								color: 0xff0000,
							},
						],
					},
				})
			}
		}

		return new Response("Unknown interaction type", { status: 400 })
	},
}
