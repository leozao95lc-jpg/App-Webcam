using System.Windows;
using iCamStudio.Desktop.ViewModels;

namespace iCamStudio.Desktop.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainViewModel();
    }
}
