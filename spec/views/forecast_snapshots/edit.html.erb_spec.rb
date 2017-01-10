require 'rails_helper'

RSpec.describe "forecast_snapshots/edit", type: :view do
  before(:each) do
    @forecast_snapshot = assign(:forecast_snapshot, ForecastSnapshot.create!(
      :name => "MyString",
      :version => "MyString",
      :comments => "MyText",
      :published => false
    ))
  end

  it "renders the edit forecast_snapshot form" do
    render

    assert_select "form[action=?][method=?]", forecast_snapshot_path(@forecast_snapshot), "post" do

      assert_select "input#forecast_snapshot_name[name=?]", "forecast_snapshot[name]"

      assert_select "input#forecast_snapshot_version[name=?]", "forecast_snapshot[version]"

      assert_select "textarea#forecast_snapshot_comments[name=?]", "forecast_snapshot[comments]"

      assert_select "input#forecast_snapshot_published[name=?]", "forecast_snapshot[published]"
    end
  end
end
