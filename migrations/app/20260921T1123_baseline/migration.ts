#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c90dc762684d433b587cad8baead46ba89f05924a2a6e566a38db4fe33824000/contract';
import endContract from '../../snapshots/c90dc762684d433b587cad8baead46ba89f05924a2a6e566a38db4fe33824000/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'attempt',
        columns: [
          col('correct', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('diagnosisJson', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('diagnosticId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inferredConfidence', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inferredMasterySignal', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('interventionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('questionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('responseTimeSeconds', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('selectedOption', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('studentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('telemetryJson', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'diagnosticSession',
        columns: [
          col('completedAt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('completedInSeconds', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('studentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'intervention',
        columns: [
          col('actionType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('completedAt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('contentJson', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('improved', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('masteryAfter', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('masteryBefore', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('startedAt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('studentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('topic', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'learnerProfile',
        columns: [
          col('byTopicJson', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('headlineDiagnosisJson', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('overallJson', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('profileConfidence', 'float8', {
            notNull: true,
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('readinessIndex', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('studentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'student',
        columns: [
          col('createdAt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('subjects', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('targetExam', 'text', {
            notNull: true,
            default: lit('JAMB'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('targetScore', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'learnerProfile',
        constraint: 'learnerProfile_studentId_key',
        columns: ['studentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attempt',
        index: 'attempt_diagnosticId_idx_928861a5',
        columns: ['diagnosticId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'attempt',
        index: 'attempt_studentId_idx_bf255322',
        columns: ['studentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'diagnosticSession',
        index: 'diagnosticSession_studentId_idx_bf255322',
        columns: ['studentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'intervention',
        index: 'intervention_studentId_idx_bf255322',
        columns: ['studentId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attempt',
        foreignKey: {
          name: 'attempt_studentId_fkey',
          columns: ['studentId'],
          references: { schema: 'public', table: 'student', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'attempt',
        foreignKey: {
          name: 'attempt_diagnosticId_fkey',
          columns: ['diagnosticId'],
          references: { schema: 'public', table: 'diagnosticSession', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'diagnosticSession',
        foreignKey: {
          name: 'diagnosticSession_studentId_fkey',
          columns: ['studentId'],
          references: { schema: 'public', table: 'student', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'intervention',
        foreignKey: {
          name: 'intervention_studentId_fkey',
          columns: ['studentId'],
          references: { schema: 'public', table: 'student', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'learnerProfile',
        foreignKey: {
          name: 'learnerProfile_studentId_fkey',
          columns: ['studentId'],
          references: { schema: 'public', table: 'student', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
