// SUBSET_SUM_PROBLEM
// This program finds and displays all subsets of a given set of positive integers 
// whose sum is equal to a specified target value (d).

#include<stdio.h>
#include<stdlib.h>

// Recursive function to find subsets
// cs - current sum of selected elements
// k  - current index being processed
// sm - remaining sum (total sum of unused elements)
// x[] - solution vector (binary flags: 1 to include, 0 to exclude)
// a[] - original sorted array
// d  - target sum
void subset(int cs, int k, int sm, int x[], int a[], int d) 
{
    int i;

    // Include current element a[k]
    x[k] = 1;

    // Check if including a[k] gives the required sum
    if (cs + a[k] == d) {
        // Print the subset
        printf("\nSubset solution: ");
        for (i = 1; i <= k; i++) 
        {
            if (x[i] == 1)
                printf("%d\t", a[i]);
        }
    }
    // Recur further only if the sum does not exceed the target
    else if (cs + a[k] + a[k + 1] <= d) {
        subset(cs + a[k], k + 1, sm - a[k], x, a, d);
    }

    // Backtrack: Exclude a[k] and move forward
    if (cs + sm - a[k] >= d && cs + a[k + 1] <= d) {
        x[k] = 0; // Do not include a[k]
        subset(cs, k + 1, sm - a[k], x, a, d);
    }
}

void main() {
    int temp, sum = 0, n, a[20], x[20], i, j, d;

    // Input number of elements
    printf("\nEnter the number of elements: ");
    scanf("%d", &n);

    // Input elements of the set
    printf("\nEnter the elements of the set: ");
    for (i = 1; i <= n; i++) 
    {
        scanf("%d", &a[i]);
        sum += a[i]; // Calculate total sum
    }

    // Input target sum
    printf("\nEnter the sum for which the subset has to be calculated: ");
    scanf("%d", &d);

    // Sort the array in ascending order (to enable pruning)
    for (i = 1; i <= n - 1; i++) 
    {
        for (j = 1; j <= n - i; j++) 
        {
            if (a[j] > a[j + 1]) {
                temp = a[j];
                a[j] = a[j + 1];
                a[j + 1] = temp;
            }
        }
    }

    // Early termination check
    if (sum < d || d < a[1]) 
    {
        printf("\nNo solution possible.");
        exit(0);
    }

    printf("\nSubset solutions that sum up to %d:", d);
    subset(0, 1, sum, x, a, d);
}