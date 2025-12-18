require 'rails_helper'

RSpec.describe "forecast_snapshots/new", type: :view do
  before(:each) do
    assign(:forecast_snapshot, ForecastSnapshot.new(
      :name => "MyString",
      :version => "MyString",
      :comments => "MyText",
      :published => false
    ))
  end

  it "renders new forecast_snapshot form" do
    render

    assert_select "form[action=?][method=?]", forecast_snapshots_path, "post" do

      assert_select "input#forecast_snapshot_name[name=?]", "forecast_snapshot[name]"

      assert_select "input#forecast_snapshot_version[name=?]", "forecast_snapshot[version]"

      assert_select "textarea#forecast_snapshot_comments[name=?]", "forecast_snapshot[comments]"

      assert_select "input#forecast_snapshot_published[name=?]", "forecast_snapshot[published]"
    end
  end
end
