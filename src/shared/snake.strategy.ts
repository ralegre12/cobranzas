// file: src/shared/snake.strategy.ts
import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';
import { snakeCase } from './snakeCase.util';

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(targetName: string, userSpecifiedName?: string): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }
  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return snakeCase(embeddedPrefixes.join('_')) + (customName ?? snakeCase(propertyName));
  }
  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(relationName + '_' + referencedColumnName);
  }
  joinTableName(first: string, second: string, firstProp: string, _secondProp: string): string {
    return snakeCase(first + '_' + firstProp.replace(/\./g, '_') + '_' + second);
  }
  joinTableColumnName(table: string, property: string, column?: string): string {
    return snakeCase(table + '_' + (column ?? property));
  }
}
