import AsyncStorage from '@react-native-async-storage/async-storage';

export type PrepStatus = 'Preparing' | 'Done' | 'Cancelled';

export interface PrepMealItem {
  id: string;
  mealId: number | string;
  mealName: string;
  ingredients: string;
  pax: number;
  status: PrepStatus;
  timestamp: number;
  deductions?: any[];
}

const STORAGE_KEY = '@savr_prep_meals';

export const MealPrepService = {
  async getMeals(): Promise<PrepMealItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to get prep meals', e);
      return [];
    }
  },

  async addMeal(meal: Omit<PrepMealItem, 'id' | 'timestamp'>): Promise<PrepMealItem> {
    try {
      const meals = await this.getMeals();
      const newMeal: PrepMealItem = {
        ...meal,
        id: `${Date.now()}_${meal.mealId}`,
        timestamp: Date.now(),
      };
      meals.unshift(newMeal);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
      return newMeal;
    } catch (e) {
      console.error('Failed to add prep meal', e);
      throw e;
    }
  },

  async updateStatus(id: string, status: PrepStatus): Promise<void> {
    try {
      const meals = await this.getMeals();
      const updated = meals.map(m => m.id === id ? { ...m, status } : m);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update prep meal status', e);
      throw e;
    }
  },

  async deleteMeals(ids: string[]): Promise<void> {
    try {
      const meals = await this.getMeals();
      const updated = meals.filter(m => !ids.includes(m.id));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete prep meals', e);
      throw e;
    }
  },
  
  async removeMeal(id: string): Promise<void> {
    try {
      const meals = await this.getMeals();
      const filtered = meals.filter(m => m.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove prep meal', e);
      throw e;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear prep meals', e);
    }
  }
};
