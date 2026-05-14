import {
  View, Text, StyleSheet, TouchableOpacity,
  LayoutAnimation, Platform, UIManager, Animated
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useTopics, Topic } from '@/hooks/useTopics'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { Subject } from '@/hooks/useSubjects'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

interface Props {
  subject: Subject
  onDeleteSubject: (id: string) => void
  onTopicPress: (subjectId: string, topicId: string) => void
  onDeleteTopic: (subjectId: string, topicId: string, topicName: string) => void
  forceExpanded?: boolean
  overrideTopics?: Topic[]
}

export function SubjectAccordion({
  subject,
  onDeleteSubject,
  onTopicPress,
  onDeleteTopic,
  forceExpanded = false,
  overrideTopics,
}: Props) {
  const [expanded, setExpanded] = useState(forceExpanded)
  const [deleteSubjectVisible, setDeleteSubjectVisible] = useState(false)
  const { topics: fetchedTopics, loading } = useTopics(subject.id)

  const topics = overrideTopics ?? fetchedTopics

  useEffect(() => {
    if (forceExpanded) setExpanded(true)
  }, [forceExpanded])

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(v => !v)
  }

  const generatingCount = topics.filter(t =>
    t.generation_status === 'pending' || t.generation_status === 'generating'
  ).length

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.subjectRow} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.subjectLeft}>
          <View style={styles.chevronWrap}>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={expanded ? Colors.blue.default : Colors.text.muted}
            />
          </View>
          <Text style={styles.subjectName}>{subject.name}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{topics.length}</Text>
          </View>
          {generatingCount > 0 && (
            <View style={styles.generatingBadge}>
              <Text style={styles.generatingBadgeText}>
                {generatingCount} generating...
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.trashBtn}
          onPress={() => setDeleteSubjectVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.text.muted} />
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.topicsWrap}>
          {loading && !overrideTopics ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : topics.length === 0 ? (
            <Text style={styles.emptyText}>No topics yet</Text>
          ) : (
            topics.map(topic => (
              <TopicRow
                key={topic.id}
                topic={topic}
                onPress={() => {
                  if (topic.generation_status === 'pending' || topic.generation_status === 'generating') return
                  onTopicPress(subject.id, topic.id)
                }}
                onDelete={() => onDeleteTopic(subject.id, topic.id, topic.name)}
              />
            ))
          )}
        </View>
      )}

      <DeleteConfirmModal
        visible={deleteSubjectVisible}
        title="Delete Subject"
        itemName={subject.name}
        description="This will permanently delete all topics and notes inside."
        onConfirm={() => { setDeleteSubjectVisible(false); onDeleteSubject(subject.id) }}
        onCancel={() => setDeleteSubjectVisible(false)}
      />
    </View>
  )
}

function TopicRow({
  topic,
  onPress,
  onDelete,
}: {
  topic: Topic
  onPress: () => void
  onDelete: () => void
}) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    if (topic.generation_status === 'pending' || topic.generation_status === 'generating') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    } else {
      pulseAnim.setValue(1)
    }
  }, [topic.generation_status, pulseAnim])

  const isPending = topic.generation_status === 'pending'
  const isGenerating = topic.generation_status === 'generating'
  const isFailed = topic.generation_status === 'failed'
  const isInProgress = isPending || isGenerating

  return (
    <TouchableOpacity
      style={[styles.topicRow, isInProgress && styles.topicRowDisabled]}
      onPress={onPress}
      activeOpacity={isInProgress ? 1 : 0.8}
    >
      {/* Left dot — always blue unless pending/generating/failed */}
      {isGenerating ? (
        <Animated.View style={[styles.topicDot, styles.topicDotGenerating, { opacity: pulseAnim }]} />
      ) : isPending ? (
        <Animated.View style={[styles.topicDot, styles.topicDotPending, { opacity: pulseAnim }]} />
      ) : isFailed ? (
        <View style={[styles.topicDot, styles.topicDotFailed]} />
      ) : (
        <View style={styles.topicDot} />
      )}

      {/* Name — skeleton shimmer while pending */}
      {isPending ? (
        <Animated.View style={[styles.skeletonName, { opacity: pulseAnim }]} />
      ) : (
        <Text
          style={[styles.topicName, isInProgress && styles.topicNameMuted]}
          numberOfLines={1}
        >
          {topic.name}
        </Text>
      )}

      {/* Right side */}
      {isGenerating && (
        <Text style={styles.generatingLabel}>writing...</Text>
      )}
      {isFailed && (
        <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
      )}
      {!isInProgress && !isFailed && (
        <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.trashBtn}>
          <Ionicons name="trash-outline" size={14} color={Colors.text.muted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  chevronWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectName: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.semibold,
    color: Colors.text.primary,
    flex: 1,
  },
  countBadge: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.text.muted,
  },
  generatingBadge: {
    backgroundColor: 'rgba(74,158,255,0.12)',
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.3)',
  },
  generatingBadgeText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.blue.default,
  },
  trashBtn: { padding: Spacing.xs },
  topicsWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.xs,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  topicRowDisabled: {
    opacity: 0.7,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.blue.default,
    flexShrink: 0,
  },
  topicDotGenerating: {
    backgroundColor: Colors.blue.default,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topicDotPending: {
    backgroundColor: Colors.text.muted,
  },
  topicDotFailed: {
    backgroundColor: Colors.error,
  },
  topicName: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.text.secondary,
  },
  topicNameMuted: {
    color: Colors.text.muted,
  },
  skeletonName: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  generatingLabel: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.blue.default,
  },
  emptyText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.text.muted,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
})
