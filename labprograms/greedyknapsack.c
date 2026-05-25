// Fractional Knapsack Problem using Greedy Method

#include <stdio.h>

#define MAX_ITEMS 100

/*
    Structure to store:
    - weights of objects
    - profits of objects
    - profit/weight ratio
    - number of objects
    - knapsack capacity
*/

typedef struct
{
    double weight[MAX_ITEMS];
    double profit[MAX_ITEMS];
    double ratio[MAX_ITEMS];

    int totalItems;

    double capacity;

} Knapsack;


/*
    Function: inputData()

    Purpose:
    Takes input for:
    - number of items
    - weights
    - profits
    - knapsack capacity

    Also calculates:
    profit/weight ratio for each item
*/

void inputData(Knapsack *k)
{
    printf("Enter the number of objects (max %d): ", MAX_ITEMS);

    scanf("%d", &k->totalItems);

    // Check maximum limit
    if (k->totalItems > MAX_ITEMS)
    {
        printf("Number of objects exceeds max limit %d\n", MAX_ITEMS);

        k->totalItems = MAX_ITEMS;
    }

    // Input weights
    printf("Enter the object's weights:\n");

    for (int i = 0; i < k->totalItems; i++)
    {
        scanf("%lf", &k->weight[i]);
    }

    // Input profits
    printf("Enter the object's profits:\n");

    for (int i = 0; i < k->totalItems; i++)
    {
        scanf("%lf", &k->profit[i]);
    }

    /*
        Calculate profit/weight ratio
        ratio = profit ÷ weight
    */

    for (int i = 0; i < k->totalItems; i++)
    {
        k->ratio[i] = k->profit[i] / k->weight[i];
    }

    // Input knapsack capacity
    printf("Enter the capacity of the knapsack: ");

    scanf("%lf", &k->capacity);
}


/*
    Function: getNextItem()

    Purpose:
    Finds the item with the highest
    profit/weight ratio.

    Returns:
    Index of the selected item
*/

int getNextItem(Knapsack *k)
{
    double highestRatio = 0;

    int selectedIndex = -1;

    for (int i = 0; i < k->totalItems; i++)
    {
        if (k->ratio[i] > highestRatio)
        {
            highestRatio = k->ratio[i];

            selectedIndex = i;
        }
    }

    return selectedIndex;
}


/*
    Function: fillKnapsack()

    Purpose:
    Fills the knapsack using the
    Greedy approach.

    Strategy:
    - Pick item with highest ratio first
    - Add full item if possible
    - Otherwise add fractional part
*/

void fillKnapsack(Knapsack *k)
{
    double currentWeight = 0;

    double currentProfit = 0;

    printf("\nObjects considered: ");

    /*
        Continue until knapsack becomes full
    */

    while (currentWeight < k->capacity)
    {
        // Get item with highest ratio
        int itemIndex = getNextItem(k);

        // No more items available
        if (itemIndex == -1)
        {
            break;
        }

        printf("%d ", itemIndex + 1);

        /*
            Check whether full item
            can be added
        */

        if (currentWeight + k->weight[itemIndex] <= k->capacity)
        {
            // Add complete item
            currentWeight += k->weight[itemIndex];

            currentProfit += k->profit[itemIndex];

            // Mark item as used
            k->ratio[itemIndex] = 0;
        }

        else
        {
            /*
                Add fractional part of item

                Formula:
                profit += ratio × remaining capacity
            */

            currentProfit +=
                k->ratio[itemIndex] *
                (k->capacity - currentWeight);

            // Knapsack becomes full
            currentWeight = k->capacity;

            break;
        }
    }

    printf("\nThe Optimal Solution (Maximum Profit) = %.2lf\n",
           currentProfit);
}


/*
    Main Function
*/

int main()
{
    Knapsack knapsack;

    inputData(&knapsack);

    fillKnapsack(&knapsack);

    return 0;
}