#include <stdio.h>
#include <omp.h>

// Function declarations
void floydShortestPath(int n, int costMatrix[20][20]);
void printDistanceMatrix(int distance[20][20], int n);
void readMatrix();

int main()
{
    readMatrix();
    return 0;
}

// Reads the cost adjacency matrix
void readMatrix()
{
    int n, i, j;
    int costMatrix[20][20];

    printf("Enter the number of vertices:\n");
    scanf("%d", &n);

    printf("Enter the cost adjacency matrix:\n");

    for(i = 0; i < n; i++)
    {
        for(j = 0; j < n; j++)
        {
            scanf("%d", &costMatrix[i][j]);
        }
    }

    printf("\nEntered Cost Adjacency Matrix:\n");

    for(i = 0; i < n; i++)
    {
        printf("\n");

        for(j = 0; j < n; j++)
        {
            printf("%d\t", costMatrix[i][j]);
        }
    }

    floydShortestPath(n, costMatrix);
}

// Floyd's Algorithm using OpenMP
void floydShortestPath(int n, int costMatrix[20][20])
{
    int i, j, k;
    int distance[20][20];

    // Copy cost matrix into distance matrix
    for(i = 0; i < n; i++)
    {
        for(j = 0; j < n; j++)
        {
            distance[i][j] = costMatrix[i][j];
        }
    }

    // Find shortest paths
    #pragma omp parallel for private(i, j)
    for(k = 0; k < n; k++) // Intermediate vertex
    {
        for(i = 0; i < n; i++) // Row
        {
            for(j = 0; j < n; j++) // Column
            {
                if(distance[i][j] >
                   distance[i][k] + distance[k][j])
                {
                    distance[i][j] =
                        distance[i][k] + distance[k][j];
                }
            }
        }
    }

    printDistanceMatrix(distance, n);
}

// Displays shortest distance matrix
void printDistanceMatrix(int distance[20][20], int n)
{
    int i, j;

    printf("\nShortest Distance Matrix:\n");

    for(i = 0; i < n; i++)
    {
        printf("\n");

        for(j = 0; j < n; j++)
        {
            if(i == j)
            {
                printf("0\t");
            }
            else
            {
                printf("%d\t", distance[i][j]);
            }
        }
    }
}