// N-Queens Problem using Backtracking in C

#include <stdio.h>

#define TRUE 1
#define FALSE 0

/*
    Function: place()

    Purpose:
    Checks whether the queen placed in row k
    attacks any previously placed queen.

    Parameters:
    x[] -> array storing column positions of queens
            x[i] = column number of queen in row i
    k   -> current row number

    Returns:
    TRUE  -> if queen placement is safe
    FALSE -> if queens attack each other
*/

int place(int x[], int k)
{
    int i;

    // Check all previously placed queens
    for(i = 1; i < k; i++)
    {
        /*
            Conditions for attack:

            1. Same column:
               x[i] == x[k]

            2. Same main diagonal:
               (row - column) is same

            3. Same secondary diagonal:
               (row + column) is same
        */

        if((x[i] == x[k]) ||
           (i - x[i] == k - x[k]) ||
           (i + x[i] == k + x[k]))
        {
            return FALSE; // Unsafe position
        }
    }

    return TRUE; // Safe position
}


/*
    Function: display()

    Purpose:
    Displays one valid arrangement of queens
    on the chessboard.

    'Q' -> Queen
    'X' -> Empty cell
*/

void display(int n, int x[])
{
    int i, j;
    char board[10][10];

    // Fill the board with X
    for(i = 1; i <= n; i++)
    {
        for(j = 1; j <= n; j++)
        {
            board[i][j] = 'X';
        }
    }

    // Place queens according to solution
    for(i = 1; i <= n; i++)
    {
        board[i][x[i]] = 'Q';
    }

    // Print the board
    for(i = 1; i <= n; i++)
    {
        for(j = 1; j <= n; j++)
        {
            printf("%c\t", board[i][j]);
        }
        printf("\n");
    }
}


/*
    Function: n_queens()

    Purpose:
    Solves the N-Queens problem using
    Backtracking technique.

    Logic:
    - Place queens row by row
    - If safe, move to next row
    - If not possible, backtrack
*/

void n_queens(int n)
{
    int x[10];      // Stores queen positions
    int k = 1;      // Start from first row
    int count = 0;  // Counts total solutions

    x[k] = 0;       // Queen not placed yet

    /*
        Continue until all possibilities
        are checked.

        k = current row number
    */

    while(k != 0)
    {
        // Try next column in current row
        x[k] = x[k] + 1;

        /*
            Keep moving queen to next column
            until a safe position is found
        */

        while((x[k] <= n) && (!place(x, k)))
        {
            x[k] = x[k] + 1;
        }

        /*
            If a safe column is found
        */

        if(x[k] <= n)
        {
            /*
                If current queen is the last queen,
                solution found
            */

            if(k == n)
            {
                count++;

                printf("\nSolution %d is:\n\n", count);

                display(n, x);
            }

            /*
                Otherwise place next queen
            */

            else
            {
                k++;        // Move to next row
                x[k] = 0;   // Initialize column
            }
        }

        /*
            No valid column found,
            so backtrack
        */

        else
        {
            k--; // Go back to previous row
        }
    }

    // If no solution exists
    if(count == 0)
    {
        printf("No solution exists.\n");
    }
}


/*
    Main Function
*/

int main()
{
    int n;

    printf("Enter value of n: ");
    scanf("%d", &n);

    n_queens(n);

    return 0;
}