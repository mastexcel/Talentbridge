import { z } from "zod";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { comment, createPost, report, requestMentorship, respondMentorship, toggleFollow, toggleGroup, toggleReaction } from "@/application/community.service";
import { commentSchema, mentorshipSchema, postSchema, reportSchema } from "@/application/schemas";

export const POST = actions<{ action: string }>({
  post: defineAction({ schema: postSchema, rateLimit: { limit: 20, windowMs: 3600_000 }, run: async ({ user }, b) => createPost(user, b.body, b.groupId) }),
  comment: defineAction({ schema: commentSchema.extend({ postId: z.string() }), rateLimit: { limit: 60, windowMs: 3600_000 }, run: async ({ user }, b) => comment(user, b.postId, b.body) }),
  react: defineAction({ schema: z.object({ postId: z.string() }), run: async ({ user }, b) => toggleReaction(user.id, b.postId) }),
  follow: defineAction({ schema: z.object({ userId: z.string() }), run: async ({ user }, b) => toggleFollow(user.id, b.userId) }),
  group: defineAction({ schema: z.object({ groupId: z.string() }), run: async ({ user }, b) => toggleGroup(user.id, b.groupId) }),
  report: defineAction({ schema: reportSchema, rateLimit: { limit: 20, windowMs: 3600_000 }, run: async ({ user }, b) => report(user, b) }),
  "mentorship-request": defineAction({ schema: mentorshipSchema, rateLimit: { limit: 10, windowMs: 86_400_000 }, run: async ({ user }, b) => requestMentorship(user, b.mentorId, b.topic, b.message) }),
  "mentorship-respond": defineAction({ schema: z.object({ id: z.string(), status: z.enum(["ACCEPTED", "DECLINED", "COMPLETED"]) }), run: async ({ user }, b) => respondMentorship(user, b.id, b.status) }),
});
