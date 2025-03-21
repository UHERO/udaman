require 'spec_helper'

describe "series/show.html.erb" do
  before(:each) do
    @series = assign(:series, stub_model(Series,
      :name => "Name",
      :frequency => "Frequency",
      :description => "Description",
      :units => 1,
      :seasonally_adjusted => false,
      :last_demetra_date => "Last Demetra Date",
      :factors => {},
      :factor_application => "Factor Application",
      :aremos_missing => 1,
      :aremos_diff => 1.5,
      :mult => 1,
      :data => {}
    ))
  end

  xit "renders attributes in <p>" do
    render
    # Run the generator again with the --webrat flag if you want to use webrat matchers
    rendered.should match(/Name/)
    rendered.should match(/Frequency/)
    rendered.should match(/Description/)
    rendered.should match(/1/)
    rendered.should match(/false/)
    rendered.should match(/Last Demetra Datestring/)
    rendered.should match(//)
    rendered.should match(/Factor Application/)
    rendered.should match(/1/)
    rendered.should match(/1.5/)
    rendered.should match(/1/)
    rendered.should match(//)
  end
end
