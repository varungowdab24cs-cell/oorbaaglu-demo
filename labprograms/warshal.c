#include <stdio.h>

/*
    Function: warshallTransitiveClosure
    -----------------------------------
    Finds the transitive closure of a graph
    using Warshall's Algorithm.

    Parameters:
        n -> Number of vertices
        adjacencyMatrix -> Adjacency matrix of the graph
*/

void warshallTransitiveClosure(int n, int adjacencyMatrix[20][20])
{
    int i, j, k;

    // Matrix to store reachability information
    int reach[20][20];

    // Copy adjacency matrix into reach matrix
    for(i = 0; i < n; i++)
    {
        for(j = 0; j < n; j++)
        {
            reach[i][j] = adjacencyMatrix[i][j];
        }
    }

    /*
        Warshall's Algorithm

        If there exists a path:
            i -> k
        and
            k -> j

        then a path exists from:
            i -> j
    */

    for(k = 0; k < n; k++) // Intermediate vertex
    {
        for(i = 0; i < n; i++) // Row
        {
            for(j = 0; j < n; j++) // Column
            {
                reach[i][j] =
                    reach[i][j] ||
                    (reach[i][k] && reach[k][j]);
            }
        }
    }

    // Display transitive closure matrix
    printf("\nTransitive Closure Matrix:\n");

    for(i = 0; i < n; i++)
    {
        for(j = 0; j < n; j++)
        {
            printf("%d\t", reach[i][j]);
        }
        printf("\n");
    }
}

int main()
{
    int n;
    int adjacencyMatrix[20][20];
    int i, j;

    // Input number of vertices
    printf("Enter the number of vertices:\n");
    scanf("%d", &n);

    // Input adjacency matrix
    printf("Enter the adjacency matrix:\n");

    for(i = 0; i < n; i++)
    {
        for(j = 0; j < n; j++)
        {
            printf("Enter edge value for (%d, %d): ", i + 1, j + 1);
            scanf("%d", &adjacencyMatrix[i][j]);
        }
    }

    // Display adjacency matrix
    printf("\nThe entered adjacency matrix is:\n");

    for(i = 0; i < n; i++)
    {
        for(j = 0; j < n; j++)
        {
            printf("%d\t", adjacencyMatrix[i][j]);
        }
        printf("\n");
    }

    // Find transitive closure
    warshallTransitiveClosure(n, adjacencyMatrix);

    return 0;
}