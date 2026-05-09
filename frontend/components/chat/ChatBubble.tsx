import { View, Text, StyleSheet } from 'react-native'
import Markdown from 'react-native-markdown-display'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Props {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function ChatBubble({ role, content, isStreaming }: Props) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{content}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantIcon}>
        <Text style={styles.assistantIconText}>✦</Text>
      </View>
      <View style={styles.assistantBubble}>
        <Markdown style={mdStyles}>
          {isStreaming ? content + ' ▋' : content}
        </Markdown>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
    paddingLeft: 48,
  },
  userBubble: {
    backgroundColor: Colors.blue.default,
    borderRadius: Layout.borderRadius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    maxWidth: '100%',
  },
  userText: {
    color: '#fff',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.regular,
    lineHeight: 22,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingRight: 16,
  },
  assistantIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(74,158,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  assistantIconText: {
    fontSize: 13,
    color: Colors.blue.default,
  },
  assistantBubble: {
    flex: 1,
  },
})

const mdStyles: any = {
  body: {
    color: Colors.text.primary,
    fontFamily: Typography.family.regular,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  paragraph: {
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    lineHeight: 24,
  },
  heading1: {
    color: Colors.text.primary,
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.lg,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  heading2: {
    color: Colors.text.primary,
    fontFamily: Typography.family.semibold,
    fontSize: Typography.size.md,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  strong: {
    fontFamily: Typography.family.bold,
    color: Colors.text.primary,
  },
  em: {
    fontStyle: 'italic',
    color: Colors.text.secondary,
  },
  bullet_list: { marginBottom: Spacing.sm },
  ordered_list: { marginBottom: Spacing.sm },
  list_item: {
    color: Colors.text.primary,
    lineHeight: 22,
  },
  code_inline: {
    backgroundColor: Colors.surfaceHigh,
    color: Colors.blue.light,
    fontFamily: 'monospace',
    paddingHorizontal: 5,
    borderRadius: 4,
    fontSize: Typography.size.sm,
  },
  fence: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.blue.default,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.sm,
    opacity: 0.85,
  },
  hr: {
    backgroundColor: Colors.border,
    height: 1,
    marginVertical: Spacing.md,
  },
}
